from django.shortcuts import render
from django.http import HttpResponse

# Hàm này sẽ xử lý việc hiển thị trang chủ
def home_view(request):
    # Tên 'home/home.html' là đường dẫn tới file template của ông
    # tính từ thư mục 'templates' gốc mà ông đã khai báo trong settings.py
    # Nếu file HTML của ông tên khác hoặc nằm ở chỗ khác trong templates, thì sửa lại cho đúng
    context = {} # Có thể truyền thêm dữ liệu vào đây nếu muốn
    return render(request, 'home/home.html', context)