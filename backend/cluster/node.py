from kafka import KafkaConsumer, KafkaProducer
import json
import os
import threading
from leader_election import RaftNode, elect_leader
import logging
import requests
import time
from flask import Flask, send_file  # Added Flask imports for HTTP server

# Configure logging
def setup_logging(node_id, cluster_id):
    logger = logging.getLogger(f'node_{node_id}_{cluster_id}')
    logger.setLevel(logging.INFO)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    os.makedirs('logs', exist_ok=True)
    file_handler = logging.FileHandler(f'logs/node_{node_id}_{cluster_id}.log')
    file_handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    return logger

class Node:
    def __init__(self, node_id, cluster_id, is_leader=False):
        self.node_id = node_id
        self.cluster_id = cluster_id
        self.is_leader = is_leader
        self.producer = KafkaProducer(bootstrap_servers='kafka:9092', value_serializer=lambda v: json.dumps(v).encode('utf-8'))
        self.files = {}
        self.logger = setup_logging(node_id, cluster_id)
        self.logger.info(f"Node {self.node_id} in cluster {self.cluster_id} initialized, is_leader={self.is_leader}")
        os.makedirs('node_files', exist_ok=True)
        
        # Initialize Flask app for serving files
        self.app = Flask(__name__)
        self.setup_routes()
        self.server_thread = threading.Thread(target=self.run_server, daemon=True)
        self.server_thread.start()
        self.logger.info(f"Started HTTP server on port {5000 + int(self.node_id)}")

    def setup_routes(self):
        @self.app.route('/files/<file_id>', methods=['GET'])
        def serve_file(file_id):
            if file_id not in self.files:
                return {"message": "File not found"}, 404
            local_path = self.files[file_id]
            return send_file(local_path, as_attachment=False)

    def run_server(self):
        # Each node runs on a different port (5001, 5002, 5003)
        port = 5000 + int(self.node_id)
        self.app.run(host='0.0.0.0', port=port, use_reloader=False)

    def fetch_and_store_file(self, file_id, path, source_node_id, source_type='supernode'):
        if file_id in self.files:
            self.logger.info(f"File {file_id} already replicated, skipping fetch")
            return
        local_path = f"node_files/{file_id}"
        try:
            if source_type == 'supernode':
                url = f"http://supernode:5000/files/{file_id}/fetch"
            else:
                # Fetch from the leader node
                source_port = 5000 + int(source_node_id)
                url = f"http://cluster1-node{source_node_id}:{source_port}/files/{file_id}"
            self.logger.info(f"Fetching file {file_id} from {source_type} (node {source_node_id}) at {url}")
            response = requests.get(url)
            response.raise_for_status()
            with open(local_path, 'wb') as f:
                f.write(response.content)
            self.files[file_id] = local_path
            self.logger.info(f"Replicated file {file_id} to local path {local_path}")
        except Exception as e:
            self.logger.error(f"Failed to replicate file {file_id} from {source_type} (node {source_node_id}): {e}")

    def replicate_file(self, file_id, path):
        # Leader fetches the file from Supernode and notifies others
        self.fetch_and_store_file(file_id, path, None, source_type='supernode')
        if self.is_leader:
            try:
                self.producer.send('replicate', {
                    'file_id': file_id,
                    'path': path,
                    'leader_node_id': self.node_id  # Include leader's node ID
                })
                self.logger.info(f"Sent replication message to 'replicate' topic: file_id={file_id}, path={path}, leader_node_id={self.node_id}")
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

def start_node(node, topic):
    def create_kafka_consumer(topics):
        retries = 5
        for i in range(retries):
            try:
                consumer = KafkaConsumer(
                    *topics,
                    bootstrap_servers='kafka:9092',
                    value_deserializer=lambda x: json.loads(x.decode('utf-8'))
                )
                node.logger.info(f"Kafka consumer connected successfully for topics {topics}")
                return consumer
            except Exception as e:
                node.logger.error(f"Kafka consumer connection attempt {i+1}/{retries} failed: {e}")
                if i < retries - 1:
                    time.sleep(5)
        raise Exception(f"Failed to connect to Kafka for topics {topics} after multiple attempts")

    topics = ['replicate']
    if node.is_leader:
        topics.append('upload')
    else:
        topics.append('delete')
    consumer = create_kafka_consumer(topics)

    def steal_work():
        while True:
            node.work_stealing()
            time.sleep(10)

    threading.Thread(target=steal_work, daemon=True).start()
    node.logger.info("Started work-stealing thread")

    for message in consumer:
        node.logger.info(f"Received Kafka message on topic {message.topic}: {message.value}")
        data = message.value
        if message.topic == 'upload':
            node.replicate_file(data['file_id'], data['path'])
        elif message.topic == 'replicate':
            node.fetch_and_store_file(
                data['file_id'],
                data['path'],
                data['leader_node_id'],
                source_type='leader'
            )
        elif message.topic == 'delete':
            node.delete_file(data['file_id'])

if __name__ == '__main__':
    import sys
    node_id = sys.argv[1]
    cluster_id = sys.argv[2]
    is_leader = sys.argv[3] == 'true'
    
    logger = setup_logging(node_id, cluster_id)
    logger.info(f"Starting node {node_id} in cluster {cluster_id}, is_leader={is_leader}")
    
    nodes = [RaftNode(i, []) for i in range(1, 4)]
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
    
    node = Node(node_id, cluster_id, is_leader)
    topic = 'upload' if is_leader else 'delete'
    start_node(node, topic)