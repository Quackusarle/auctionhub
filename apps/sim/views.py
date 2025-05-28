import json
from django.shortcuts import render, redirect
from django.http import HttpResponse, JsonResponse
from django.contrib.auth.decorators import login_required
from .models import Item, Image
from .services import generate_signature
from django.utils import timezone
from django.contrib import messages

@login_required
def create_item(request):
    if request.method == 'GET':
        return render(request, 'create_item.html', {
            'form_data': {},
            'errors': {},
            'message': ''
        })

    if request.method == 'POST':
        errors = {}
        form_data = {
            'name': request.POST.get('name', ''),
            'description': request.POST.get('description', ''),
            'starting_price': request.POST.get('starting_price', ''),
            'end_time': request.POST.get('end_time', ''),
        }

        # Validate form fields
        if not form_data['name']:
            errors['name'] = ['Tên sản phẩm là bắt buộc.']
        if not form_data['description']:
            errors['description'] = ['Mô tả là bắt buộc.']
        if not form_data['starting_price'] or float(form_data['starting_price']) < 1000:
            errors['starting_price'] = ['Giá khởi điểm phải lớn hơn hoặc bằng 1000 VNĐ.']
        if not form_data['end_time']:
            errors['end_time'] = ['Thời gian kết thúc là bắt buộc.']
        elif timezone.datetime.fromisoformat(form_data['end_time'].replace('T', ' ')) <= timezone.now():
            errors['end_time'] = ['Thời gian kết thúc phải ở tương lai.']
        
        image_data = request.POST.get('image_data', '')
        if not image_data:
            errors['image_data'] = ['Hình ảnh là bắt buộc.']

        if errors:
            return render(request, 'create_item.html', {
                'form_data': form_data,
                'errors': errors,
                'message': ''
            })

        try:
            image_data = json.loads(image_data)
            item = Item.objects.create(
                name=form_data['name'],
                description=form_data['description'],
                starting_price=form_data['starting_price'],
                current_price=form_data['starting_price'],
                end_time=form_data['end_time'],
                owner=request.user
            )
            Image.objects.create(
                item=item,
                key=image_data['public_id'],
                url=image_data['secure_url'],
                name=image_data['original_filename'],
                width=image_data['width'],
                height=image_data['height'],
                format=image_data['format']
            )
            messages.success(request, 'Tạo phiên đấu giá thành công!')
            return redirect('item-list')
        except Exception as e:
            errors['non_field_errors'] = [str(e)]
            return render(request, 'create_item.html', {
                'form_data': form_data,
                'errors': errors,
                'message': ''
            })

def get_upload_url(request):
    if request.method == 'GET':
        signature_data = generate_signature()
        return JsonResponse(signature_data)
    return JsonResponse({'error': 'Method not allowed'}, status=405)