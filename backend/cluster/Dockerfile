FROM python:3.9
WORKDIR /app
COPY . .
RUN pip install kafka-python requests flask psutil
CMD ["python", "node.py"]