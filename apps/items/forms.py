# apps/items/forms.py
from django import forms
from .models import Item
from django.utils import timezone

class ItemCreateForm(forms.ModelForm):
    # Trường image_url được khai báo tường minh ở đây để tùy chỉnh widget và cờ 'required'.
    # ModelForm sẽ sử dụng định nghĩa này thay vì tự tạo từ model.
    image_url = forms.CharField(widget=forms.HiddenInput(), required=True)

    class Meta:
        model = Item
        # THÊM 'image_url' VÀO ĐÂY
        fields = ['name', 'description', 'starting_price', 'end_time', 'image_url']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Tên sản phẩm/phiên đấu giá'
            }),
            'description': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Mô tả chi tiết sản phẩm'
            }),
            'starting_price': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': '1000',
                'step': '1000',
                'placeholder': 'Giá khởi điểm (VNĐ)'
            }),
            'end_time': forms.DateTimeInput(attrs={
                'class': 'form-control',
                'type': 'datetime-local'
            }),
            # Không cần khai báo widget cho image_url ở đây nữa
            # vì nó đã được khai báo tường minh ở trên với HiddenInput().
            # Nếu không khai báo tường minh image_url ở trên, có thể thêm:
            # 'image_url': forms.HiddenInput()
        }

    def clean_starting_price(self):
        starting_price = self.cleaned_data.get('starting_price')
        if starting_price is not None and starting_price <= 0:
            raise forms.ValidationError("Giá khởi điểm phải lớn hơn 0")
        return starting_price

    def clean_end_time(self):
        end_time = self.cleaned_data.get('end_time')
        if end_time and end_time <= timezone.now():
            raise forms.ValidationError("Thời gian kết thúc phải ở tương lai")
        return end_time

    def clean_image_url(self):
        image_url = self.cleaned_data.get('image_url')
        # Kiểm tra xem image_url có phải là chuỗi không trước khi gọi startswith
        if not isinstance(image_url, str) or not image_url.startswith(('http://', 'https://')):
            raise forms.ValidationError("Hình ảnh sản phẩm phải là một URL hợp lệ từ Cloudinary.")
        return image_url