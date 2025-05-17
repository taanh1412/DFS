from kafka import KafkaConsumer
import json
import os

consumer = KafkaConsumer('sync', bootstrap_servers='kafka:9092', value_deserializer=lambda x: json.loads(x.decode('utf-8')))

def save_data(file_path, data):
    with open(file_path, 'w') as f:
        json.dump(data, f)

for message in consumer:
    data = message.value
    save_data('users.json', data['users'])
    save_data('files.json', data['files'])