from kafka import KafkaConsumer, KafkaProducer
from kafka.admin import KafkaAdminClient
import json
import os
import threading
from leader_election import RaftNode, elect_leader
import logging
import requests
import time
import psutil
import sys
from flask import Flask, send_file

# Add 10-second delay at startup
print(f"Starting Node {sys.argv[1]} in Cluster {sys.argv[2]} with 10-second delay...")
time.sleep(10)
print(f"Delay completed, starting Node {sys.argv[1]} in Cluster {sys.argv[2]}...")

# Configure logging
def setup_logging(node_id, cluster_id):
    logger = logging.getLogger(f'node_{node_id}_{cluster_id}')
    logger.setLevel(logging.DEBUG)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    os.makedirs('logs', exist_ok=True)
    file_handler = logging.FileHandler(f'logs/node_{node_id}_{cluster_id}.log')
    file_handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    return logger

# Function to wait for Kafka to be ready
def wait_for_kafka(node_id, cluster_id):
    retries = 6
    for i in range(retries):
        try:
            admin_client = KafkaAdminClient(bootstrap_servers='kafka:9092')
            admin_client.list_topics()
            print(f"Kafka is ready for node {node_id} in cluster {cluster_id}")
            return
        except Exception as e:
            print(f"Kafka not ready for node {node_id} in cluster {cluster_id}, attempt {i+1}/{retries}: {e}")
            if i < retries - 1:
                time.sleep(5)
    raise Exception(f"Kafka failed to start after maximum retries for node {node_id} in cluster {cluster_id}")

class Node:
    def __init__(self, node_id, cluster_id):
        self.node_id = node_id
        self.cluster_id = cluster_id  # Ensure cluster_id is a string
        self.is_leader = False
        self.start_time = time.time()
        self.logger = setup_logging(node_id, cluster_id)
        self.logger.info(f"Node {self.node_id} in cluster {self.cluster_id} initialized")
        wait_for_kafka(node_id, cluster_id)
        self.producer = KafkaProducer(
            bootstrap_servers='kafka:9092',
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            retries=5,
            acks='all'
        )
        self.files = {}
        os.makedirs('node_files', exist_ok=True)
        
        self.app = Flask(__name__)
        self.setup_routes()
        self.server_thread = threading.Thread(target=self.run_server, daemon=True)
        self.server_thread.start()
        self.logger.info(f"Started HTTP server on port {5000 + int(self.node_id)}")

    def setup_routes(self):
        @self.app.route('/files/<file_id>', methods=['GET'])
        def serve_file(file_id):
            if file_id in self.files:
                local_path = self.files[file_id]
                return send_file(local_path, as_attachment=False)
            return {"message": "File not found"}, 404

    def run_server(self):
        port = 5000 + int(self.node_id)
        self.app.run(host='0.0.0.0', port=port, use_reloader=False)

    def fetch_and_store_file(self, file_id, path, source_node_id, source_cluster_id, source_type='supernode'):
        if file_id in self.files:
            self.logger.info(f"File {file_id} already replicated, skipping fetch")
            return
        local_path = f"node_files/{file_id}"
        try:
            if source_type == 'supernode':
                url = f"http://supernode:5000/files/{file_id}/fetch"
            else:
                source_port = 5000 + int(source_node_id)
                url = f"http://cluster{source_cluster_id}-node{source_node_id}:{source_port}/files/{file_id}"  # Use source_cluster_id
            self.logger.info(f"Fetching file {file_id} from {source_type} (node {source_node_id}, cluster {source_cluster_id}) at {url}")
            response = requests.get(url)
            response.raise_for_status()
            with open(local_path, 'wb') as f:
                f.write(response.content)
            self.files[file_id] = local_path
            self.logger.info(f"Replicated file {file_id} to local path {local_path}")
        except Exception as e:
            self.logger.error(f"Failed to replicate file {file_id} from {source_type} (node {source_node_id}, cluster {source_cluster_id}): {e}")

    def replicate_file(self, file_id, path):
        self.logger.info(f"Received file_id: {file_id} (type: {type(file_id)})")
        self.fetch_and_store_file(file_id, path, None, None, source_type='supernode')
        if self.is_leader:
            try:
                self.producer.send('replicate', {
                    'file_id': file_id,
                    'path': path,
                    'leader_node_id': self.node_id,
                    'cluster_id': self.cluster_id
                }).get(timeout=10)
                self.logger.info(f"Sent replication message to 'replicate' topic: file_id={file_id}, path={path}, leader_node_id={self.node_id}, cluster_id={self.cluster_id}")
            except Exception as e:
                self.logger.error(f"Failed to send replication message to 'replicate' topic: {e}")

    def delete_file(self, file_id):
        if file_id in self.files:
            local_path = self.files[file_id]
            try:
                os.remove(local_path)
                self.logger.info(f"Removed local copy of file {file_id} at {local_path}")
            except Exception as e:
                self.logger.error(f"Failed to remove local copy of file {file_id}: {e}")
            del self.files[file_id]
            self.logger.info(f"Deleted file {file_id} from metadata")
        else:
            self.logger.warning(f"File {file_id} not found for deletion")

    def work_stealing(self):
        self.logger.info("Performing work-stealing")

    def send_health_message(self):
        while True:
            try:
                uptime = time.time() - self.start_time
                memory_usage = psutil.virtual_memory().percent
                health_message = {
                    'node_id': self.node_id,
                    'cluster_id': self.cluster_id,
                    'is_leader': self.is_leader,
                    'uptime': uptime,
                    'memory_usage': memory_usage,
                    'timestamp': time.time(),
                    'type': 'health'
                }
                self.producer.send('health', health_message).get(timeout=10)
                self.logger.info(f"Sent health message: {health_message}")
            except Exception as e:
                self.logger.error(f"Failed to send health message: {e}")
            time.sleep(5)

def start_node(node, topic, nodes, raft_node):
    consumer = None
    consumer_thread = None
    consumer_lock = threading.Lock()
    should_stop = threading.Event()
    current_topics = set()
    health_thread = None
    health_should_stop = threading.Event()

    def create_kafka_consumer(topics, group_id, auto_offset_reset='latest'):
        wait_for_kafka(node.node_id, node.cluster_id)
        retries = 5
        for i in range(retries):
            try:
                consumer = KafkaConsumer(
                    *topics,
                    bootstrap_servers='kafka:9092',
                    value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                    group_id=group_id,
                    auto_offset_reset=auto_offset_reset,
                    enable_auto_commit=True  # Enable auto-commit to avoid duplicates
                )
                node.logger.info(f"Kafka consumer connected successfully for topics {topics} with group_id {group_id}")
                return consumer
            except Exception as e:
                node.logger.error(f"Kafka consumer connection attempt {i+1}/{retries} failed: {e}")
                if i < retries - 1:
                    time.sleep(5)
        raise Exception(f"Failed to connect to Kafka for topics {topics} after multiple attempts")

    def consume_messages():
        while not should_stop.is_set():
            try:
                # Poll for messages with a timeout to avoid blocking indefinitely
                messages = consumer.poll(timeout_ms=1000)
                for topic, partition_messages in messages.items():
                    for message in partition_messages:
                        data = message.value
                        node.logger.info(f"Received Kafka message on topic {message.topic}: {data}")
                        if message.topic == 'upload':
                            node.replicate_file(data['file_id'], data['path'])
                        elif message.topic == 'replicate':
                            if str(data['cluster_id']) == str(node.cluster_id):
                                node.fetch_and_store_file(
                                    data['file_id'],
                                    data['path'],
                                    data['leader_node_id'],
                                    data['cluster_id'],  # Pass the source cluster ID
                                    source_type='leader'
                                )
                            else:
                                node.logger.debug(f"Ignoring replicate message for cluster {data['cluster_id']}, this node is in cluster {node.cluster_id}")
                        elif message.topic == 'delete':
                            node.delete_file(data['file_id'])
            except Exception as e:
                node.logger.error(f"Error in consume_messages: {e}")
                time.sleep(1)

    def consume_health_messages():
        while raft_node.leader is None:
            node.logger.info("Waiting for initial leader to be set before consuming health messages")
            time.sleep(1)
        node.logger.info(f"Starting health message consumption with leader {raft_node.leader}")
        health_consumer = create_kafka_consumer(
            ['health'],
            f"health_{node.cluster_id}_{node.node_id}",
            auto_offset_reset='earliest'
        )
        while not health_should_stop.is_set():
            try:
                messages = health_consumer.poll(timeout_ms=1000)
                for topic, partition_messages in messages.items():
                    for message in partition_messages:
                        data = message.value
                        node.logger.debug(f"Processing health message: {data}")
                        if data['cluster_id'] != node.cluster_id:
                            node.logger.debug(f"Skipping message from different cluster: {data['cluster_id']}")
                            continue
                        if data['type'] == 'health' and str(data['node_id']) == str(raft_node.leader):
                            is_leader_alive = data['is_leader']
                            timestamp = data['timestamp']
                            raft_node.update_leader_status(is_leader_alive, timestamp)
                            node.logger.info(f"Received health message from leader {data['node_id']}: is_leader={is_leader_alive}, timestamp={timestamp}")
                        elif data['type'] == 'new_leader':
                            if data['term'] > raft_node.current_term:
                                raft_node.current_term = data['term']
                                raft_node.leader = data['leader_id']
                                raft_node.state = 'follower'
                                raft_node.last_heartbeat_check = time.time()
                                node.is_leader = (data['leader_id'] == node.node_id)
                                node.logger.info(f"Updated to new leader {data['leader_id']} for term {data['term']}")
            except Exception as e:
                node.logger.error(f"Error in consume_health_messages: {e}")
                time.sleep(1)
        health_consumer.close()

    def monitor_and_update_leadership():
        nonlocal consumer, consumer_thread, current_topics
        node.logger.info(f"Initial leader set: {raft_node.leader}")
        while True:
            topics = ['replicate']
            if node.is_leader:
                topics.append('upload')
            else:
                topics.append('delete')
            group_id = f"node_{node.node_id}_{node.cluster_id}"
            
            with consumer_lock:
                if set(topics) != current_topics:
                    if consumer is not None:
                        should_stop.set()
                        consumer_thread.join()
                        consumer.close()
                        node.logger.info("Closed previous Kafka consumer")
                    should_stop.clear()
                    consumer = create_kafka_consumer(topics, group_id)
                    consumer_thread = threading.Thread(target=consume_messages, daemon=True)
                    consumer_thread.start()
                    current_topics = set(topics)
                    node.logger.info(f"Started Kafka consumer thread with topics {topics}")
            
            if raft_node.monitor_leader():
                node.logger.info(f"Node {node.node_id} elected as new leader after failure")
                node.is_leader = True
            elif raft_node.state != 'leader' and raft_node.leader != node.node_id:
                node.logger.info(f"Node {node.node_id} updated: no longer leader, current leader is {raft_node.leader}")
                node.is_leader = False
            time.sleep(0.05)

    threading.Thread(target=monitor_and_update_leadership, daemon=True).start()
    node.logger.info("Started leader monitoring thread")

    health_thread = threading.Thread(target=consume_health_messages, daemon=True)
    health_thread.start()
    node.logger.info("Started health consumer thread")

    health_report_thread = threading.Thread(target=node.send_health_message, daemon=True)
    health_report_thread.start()
    node.logger.info("Started health reporting thread")

    def steal_work():
        while True:
            node.work_stealing()
            time.sleep(10)

    threading.Thread(target=steal_work, daemon=True).start()
    node.logger.info("Started work-stealing thread")

    while True:
        time.sleep(1)

if __name__ == '__main__':
    import sys
    node_id = sys.argv[1]
    cluster_id = sys.argv[2]
    
    logger = setup_logging(node_id, cluster_id)
    logger.info(f"Starting node {node_id} in cluster {cluster_id}")
    
    if cluster_id == '1':
        node_ids = [1, 2, 3]
    elif cluster_id == '2':
        node_ids = [4, 5, 6]
    else:
        raise ValueError(f"Unsupported cluster_id: {cluster_id}")
    
    nodes = [RaftNode(i, [], cluster_id) for i in node_ids]
    for i, n in enumerate(nodes):
        n.nodes = nodes
    logger.info("Starting leader election")
    try:
        leader = elect_leader(nodes)
        logger.info(f"Elected leader is node {leader.node_id}")
        is_leader = (str(leader.node_id) == node_id)
        logger.info(f"Leader election completed. Node {node_id} is_leader={is_leader}")
    except Exception as e:
        logger.error(f"Leader election failed: {e}")
        raise
    
    node = Node(node_id, cluster_id)
    node.is_leader = is_leader
    topic = 'upload' if is_leader else 'delete'
    raft_node = next(n for n in nodes if n.node_id == int(node_id))
    start_node(node, topic, nodes, raft_node)