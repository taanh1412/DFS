FROM python:3.9
WORKDIR /app
COPY . .
RUN pip install flask pyjwt kafka-python flask-cors redis
CMD ["python", "app.py"]