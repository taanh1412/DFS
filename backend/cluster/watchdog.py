from kafka import KafkaConsumer, KafkaProducer
import json
import time
import logging
import random
import sys
import os 
# Configure logging
def setup_logging(cluster_id):
    logger = logging.getLogger(f'watchdog_cluster_{cluster_id}')
    logger.setLevel(logging.DEBUG)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    try:
        os.makedirs('logs', exist_ok=True)
        file_handler = logging.FileHandler(f'logs/watchdog_cluster_{cluster_id}.log')
        file_handler.setLevel(logging.DEBUG)
    except Exception as e:
        print(f"Failed to create log file for cluster {cluster_id}: {e}")
        file_handler = logging.NullHandler()  # Fallback to null handler if file creation fails
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    return logger

# Function to wait for Kafka to be ready


def run_watchdog(cluster_id):
    # Initialize logging immediately to capture all messages
    logger = setup_logging(cluster_id)
    
    logger.info(f"Starting Watchdog for Cluster {cluster_id} with 10-second delay...")
    time.sleep(10)
    logger.info(f"Delay completed, starting Watchdog for Cluster {cluster_id}...")

    logger.info(f"Watchdog started for cluster {cluster_id}")

    # Wait for Kafka to be ready

    try:
        consumer = KafkaConsumer(
            'health',
            bootstrap_servers='kafka:9092',
            value_deserializer=lambda x: json.loads(x.decode('utf-8')),
            group_id=f"watchdog_{cluster_id}",
            auto_offset_reset='earliest',
            enable_auto_commit=True
        )
        logger.info("Kafka consumer initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Kafka consumer: {e}")
        sys.exit(1)

    try:
        producer = KafkaProducer(
            bootstrap_servers='kafka:9092',
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        logger.info("Kafka producer initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Kafka producer: {e}")
        sys.exit(1)

    node_status = {}
    leader_id = None
    term = 1

    FAILURE_THRESHOLD = 15

    while True:
        try:
            logger.debug("Polling for health messages...")
            messages = consumer.poll(timeout_ms=1000)
            for topic, partition_messages in messages.items():
                for message in partition_messages:
                    data = message.value
                    if data['cluster_id'] != cluster_id:
                        continue
                    if data['type'] != 'health':
                        continue
                    node_id = data['node_id']
                    timestamp = data['timestamp']
                    uptime = data['uptime']
                    memory_usage = data['memory_usage']
                    is_leader = data['is_leader']
                    node_status[node_id] = {
                        'last_seen': timestamp,
                        'uptime': uptime,
                        'memory_usage': memory_usage,
                        'is_leader': is_leader
                    }
                    logger.debug(f"Received health message from node {node_id}: {node_status[node_id]}")
                    if is_leader:
                        leader_id = node_id
                        logger.info(f"Updated leader to node {leader_id} based on health message")

            current_time = time.time()
            failed_nodes = []
            for node_id, status in list(node_status.items()):
                time_since_last_seen = current_time - status['last_seen']
                logger.debug(f"Checking node {node_id}: time since last seen = {time_since_last_seen:.2f} seconds")
                if time_since_last_seen > FAILURE_THRESHOLD:
                    logger.warning(f"Node {node_id} failed (last seen {time_since_last_seen:.2f} seconds ago)")
                    failed_nodes.append(node_id)
                    del node_status[node_id]

            for node_id in failed_nodes:
                if node_id == leader_id:
                    if node_status:
                        eligible_nodes = [
                            (nid, status) for nid, status in node_status.items()
                            if not status['is_leader']
                        ]
                        if eligible_nodes:
                            eligible_nodes.sort(key=lambda x: (-x[1]['uptime'], x[0]))
                            new_leader_id = eligible_nodes[0][0]
                            term += 1
                            logger.info(f"Leader {leader_id} failed, assigning node {new_leader_id} as new leader for term {term}")
                            producer.send('health', {
                                'type': 'new_leader',
                                'leader_id': new_leader_id,
                                'term': term,
                                'cluster_id': cluster_id
                            }).get(timeout=10)
                            leader_id = new_leader_id
                            node_status[new_leader_id]['is_leader'] = True
                        else:
                            logger.warning("No eligible nodes to assign as new leader")
                            leader_id = None
                    else:
                        logger.warning("No nodes remaining in cluster")
                        leader_id = None
                else:
                    if node_status and leader_id in node_status:
                        eligible_nodes = [
                            nid for nid, status in node_status.items()
                            if nid != leader_id and not status['is_leader']
                        ]
                        if eligible_nodes:
                            target_node = random.choice(eligible_nodes)
                            logger.info(f"Node {node_id} failed, reassigning tasks to node {target_node}")
                            producer.send('replicate', {
                                'file_id': f"reassigned_from_{node_id}",
                                'path': f"files/reassigned_from_{node_id}",
                                'leader_node_id': leader_id,
                                'cluster_id': cluster_id,
                                'target_node_id': target_node
                            }).get(timeout=10)
                        else:
                            logger.warning(f"No eligible nodes to reassign tasks from failed node {node_id}")

            time.sleep(1)
        except Exception as e:
            logger.error(f"Error in watchdog: {e}")
            time.sleep(1)

if __name__ == '__main__':
    import sys
    if len(sys.argv) != 2:
        print("Usage: python watchdog.py <cluster_id>")
        sys.exit(1)
    cluster_id = sys.argv[1]
    run_watchdog(cluster_id)