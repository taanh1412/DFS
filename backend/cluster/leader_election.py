import random
import time
import logging

# Configure logging for leader election
def setup_logging(node_id):
    logger = logging.getLogger(f'raft_node_{node_id}')
    logger.setLevel(logging.INFO)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    return logger

class RaftNode:
    def __init__(self, node_id, nodes):
        self.node_id = node_id
        self.nodes = nodes
        self.state = 'follower'
        self.current_term = 0
        self.voted_for = None
        self.leader = None
        self.logger = setup_logging(node_id)
        self.logger.info(f"RaftNode {self.node_id} initialized as {self.state}")

    def start_election(self):
        self.state = 'candidate'
        self.current_term += 1
        self.voted_for = self.node_id
        self.logger.info(f"Starting election for term {self.current_term}, voted for self")
        votes = 1  # Vote for self
        for node in self.nodes:
            if node != self:
                # Deterministic voting: vote yes if this node's term is higher
                if node.voted_for is None or node.current_term < self.current_term:
                    votes += 1
                    node.voted_for = self.node_id
                    node.current_term = self.current_term
                    self.logger.debug(f"Received vote from node {node.node_id}")
        self.logger.info(f"Election completed, received {votes} votes out of {len(self.nodes)}")
        if votes > len(self.nodes) // 2:
            self.state = 'leader'
            self.leader = self.node_id
            self.logger.info(f"Elected as leader for term {self.current_term}")
            return True
        self.state = 'follower'
        self.logger.info(f"Failed to become leader, reverting to follower")
        return False

    def run(self):
        attempts = 0
        while attempts < 10:  # Limit attempts to prevent infinite loop
            if self.state == 'follower' and random.random() < 0.5:  # Increased probability to 50%
                self.logger.info("Election timeout, starting new election")
                if self.start_election():
                    return True
            time.sleep(1)
            attempts += 1
        self.logger.warning("No leader elected after maximum attempts")
        return False

def elect_leader(nodes):
    attempts = 0
    while attempts < 10:  # Limit attempts to prevent infinite loop
        for node in nodes:
            if node.run() and node.state == 'leader':
                return node
        attempts += 1
        time.sleep(1)
    raise Exception("Failed to elect a leader after maximum attempts")