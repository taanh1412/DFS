from kafka import KafkaConsumer
import json
import time

# List of topics to monitor
TOPICS = ["health", "status"]

def monitor_kafka_messages(from_beginning=False):
    # Configure the Kafka consumer
    consumer = KafkaConsumer(
        *TOPICS,
        bootstrap_servers='kafka:9092',
        value_deserializer=lambda x: json.loads(x.decode('utf-8')),
        group_id='monitor_group',
        auto_offset_reset='earliest' if from_beginning else 'latest',
        enable_auto_commit=True
    )

    print(f"Monitoring messages from topics: {TOPICS}")
    print(f"Reading from {'beginning' if from_beginning else 'latest'} offset")
    print("Press Ctrl+C to stop...")

    try:
        for message in consumer:
            topic = message.topic
            partition = message.partition
            offset = message.offset
            timestamp = message.timestamp
            value = message.value
            # Convert timestamp to readable format
            timestamp_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp / 1000))
            print(f"[{timestamp_str}] Topic: {topic}, Partition: {partition}, Offset: {offset}, Message: {value}")
    except KeyboardInterrupt:
        print("\nStopping Kafka monitor...")
    finally:
        consumer.close()

if __name__ == "__main__":
    import sys
    # Check if the user wants to read from the beginning
    from_beginning = len(sys.argv) > 1 and sys.argv[1] == "--from-beginning"
    monitor_kafka_messages(from_beginning=from_beginning)