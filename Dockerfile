FROM python:3.11-slim

WORKDIR /code

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY ./app /code/app
COPY ./tests /code/tests

RUN chmod -R 755 /code

EXPOSE 81

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-81}"]