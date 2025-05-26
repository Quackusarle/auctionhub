#!/bin/bash

echo "BUILD START"
pip3 install -r requirements.txt
python3 manage.py collectstatic --noinput --clear
python3 manage.py migrate --noinput
echo "BUILD END"
