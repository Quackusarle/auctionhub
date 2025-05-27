#!/bin/bash

echo "BUILD START"

echo "Running system checks..."
python3 manage.py check --deploy

echo "Collecting static files..."
python3 manage.py collectstatic --noinput --clear

echo "Running migrations..."
python3 manage.py migrate --noinput

echo "BUILD END"
