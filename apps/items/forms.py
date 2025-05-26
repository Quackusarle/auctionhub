from django import forms
from .models import Item
from django.utils import timezone

class ItemCreateForm(forms.ModelForm):
    class Meta:
        model = Item
        fields = ['name', 'description', 'starting_price', 'end_time']
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