from kafka import KafkaConsumer
from kafka.admin import KafkaAdminClient  # Added for Kafka readiness check
import json
import redis
import time

# Initialize Redis client
redis_client = redis.Redis(host='redis', port=6379, db=0, decode_responses=True)

# Function to wait for Kafka to be ready
def wait_for_kafka():
    retries = 6
    for i in range(retries):
        try:
            admin_client = KafkaAdminClient(bootstrap_servers='kafka:9092')
            admin_client.list_topics()
            print("Kafka is ready")
            return
        except Exception as e:
            print(f"Kafka not ready, attempt {i+1}/{retries}: {e}")
            if i < retries - 1:
                time.sleep(5)
    raise Exception("Kafka failed to start after maximum retries")

# Wait for Kafka before starting the consumer
wait_for_kafka()

consumer = KafkaConsumer('sync', bootstrap_servers='kafka:9092', value_deserializer=lambda x: json.loads(x.decode('utf-8')))

for message in consumer:
    data = message.value
    with open('users.json', 'w') as f:
        json.dump(data['users'], f)
    for file_id, file_data in data['files'].items():
        redis_client.hset(f"file:{file_id}", mapping=file_data)
    for key in redis_client.keys('shared_with:*'):
        redis_client.delete(key)
    for email, shared_files in data['shared_with'].items():
        if shared_files:
            redis_client.sadd(f"shared_with:{email}", *shared_files)