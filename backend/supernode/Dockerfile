FROM python:3.9
WORKDIR /app
COPY . .
RUN pip install flask pyjwt kafka-python flask-cors redis
EXPOSE 5000
CMD ["python", "app.py"]