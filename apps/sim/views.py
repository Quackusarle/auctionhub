import json
from django.http import HttpResponse
from django.shortcuts import render
from .models import Image
from .services import generate_signature

def index(request) -> HttpResponse:
    if request.method == 'GET':
        images = Image.objects.all().order_by('-created_at')
        return render(
            request, 'index.html', context={
                'images': images, **generate_signature()
            }
        )
    elif request.method == 'POST':
        body = request.body.decode('utf-8')
        data = json.loads(body)
        Image.objects.create(
            key=data['public_id'], url=data['secure_url'],
            width=data['width'], height=data['height'],
            format=data['format'], name=data['original_filename'],
        )
        return HttpResponse(status=201)