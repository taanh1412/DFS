#!/bin/bash
kafka-topics --create --topic upload --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1
kafka-topics --create --topic delete --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1
kafka-topics --create --topic sync --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1
kafka-topics --create --topic replicate --bootstrap-server kafka:9092 --partitions 1 --replication-factor 1  # Added replicate topic