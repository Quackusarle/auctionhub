from django.db import models

class Image(models.Model):
    key = models.CharField(help_text="The public id of the uploaded file", max_length=100)
    url = models.CharField(max_length=100)
    name = models.CharField(max_length=100, help_text='The original name of the uploaded image')
    width = models.IntegerField(help_text='Width in pixels')
    height = models.IntegerField(help_text='Height in pixels')
    format = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)