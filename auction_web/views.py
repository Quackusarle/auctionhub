from django.shortcuts import render
from django.http import HttpResponse
from apps.items.models import Item

# Hàm này sẽ xử lý việc hiển thị trang chủ
def home_view(request):
    # Tên 'home/home.html' là đường dẫn tới file template của ông
    # tính từ thư mục 'templates' gốc mà ông đã khai báo trong settings.py
    # Nếu file HTML của ông tên khác hoặc nằm ở chỗ khác trong templates, thì sửa lại cho đúng
    context = {} # Có thể truyền thêm dữ liệu vào đây nếu muốn
    return render(request, 'home/home.html', context)

def register_view(request):
    context = {}
    return render(request, 'account/signup.html', context)

def profile_view(request):
    context = {}
    return render(request, 'account/profile.html', context)

def about(request):
    return render(request, 'about/about.html')