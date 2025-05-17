import random
import time
import logging

# Configure logging for leader election
def setup_logging(node_id):
    logger = logging.getLogger(f'raft_node_{node_id}')
    logger.setLevel(logging.DEBUG)  # Changed to DEBUG for better visibility
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    return logger

class RaftNode:
    def __init__(self, node_id, nodes, cluster_id):
        self.node_id = node_id
        self.nodes = nodes
        self.cluster_id = cluster_id
        self.state = 'follower'
        self.current_term = 0
        self.leader = None
        self.logger = setup_logging(node_id)
        self.logger.info(f"RaftNode {self.node_id} initialized as {self.state}")
        self.election_timeout = random.uniform(10, 20)
        self.last_heartbeat_check = time.time()
        self.last_leader_health_message = time.time()
        self.leader_is_alive = False

    def ping_leader(self):
        if self.leader is None:
            self.logger.debug("No leader set, assuming leader is down")
            return False
        current_time = time.time()
        if self.leader_is_alive and (current_time - self.last_heartbeat_check) < self.election_timeout:
            self.logger.debug(f"Leader {self.leader} is alive, last health message at {self.last_leader_health_message}")
            return True
        self.logger.debug(f"No recent health message from leader {self.leader}, last received at {self.last_leader_health_message}, current time {current_time}")
        return False

    def update_leader_status(self, is_leader_alive, timestamp):
        self.leader_is_alive = is_leader_alive
        if is_leader_alive:
            self.last_leader_health_message = timestamp
            self.last_heartbeat_check = time.time()
        self.logger.debug(f"Updated leader status: is_leader_alive={is_leader_alive}, timestamp={timestamp}")

    def monitor_leader(self):
        while True:
            if self.state != 'leader':
                current_time = time.time()
                if (current_time - self.last_heartbeat_check) > self.election_timeout:
                    self.logger.info(f"Election timeout ({self.election_timeout:.2f}s), checking leader status")
                    if not self.ping_leader():
                        self.logger.info(f"Leader {self.leader} confirmed down, waiting for watchdog to assign new leader")
                        self.last_heartbeat_check = time.time()
                    else:
                        self.logger.debug(f"Leader {self.leader} is still alive, resetting timeout")
                        self.last_heartbeat_check = time.time()
            time.sleep(0.05)
        return False

def elect_leader(nodes):
    cluster_id = nodes[0].cluster_id
    if cluster_id == '1':
        first_node_id = 1
    elif cluster_id == '2':
        first_node_id = 4
    else:
        raise ValueError(f"Unsupported cluster_id: {cluster_id}")

    for node in nodes:
        if node.node_id == first_node_id:
            node.state = 'leader'
            node.leader = node.node_id
            node.current_term = 1
            node.logger.info(f"Set as initial leader for term {node.current_term}")
            for n in nodes:
                if n != node:
                    n.leader = node.node_id
                    n.current_term = node.current_term
                    n.last_heartbeat_check = time.time()
            return node

    raise Exception(f"First node {first_node_id} not found in cluster {cluster_id}")