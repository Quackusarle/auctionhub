from django.db import models
from django.conf import settings

class Item(models.Model):
    item_id = models.AutoField(primary_key=True)
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    image_url = models.CharField(max_length=255, blank=True, null=True)
    starting_price = models.DecimalField(max_digits=15, decimal_places=0)
    current_price = models.DecimalField(max_digits=15, decimal_places=0, default=0)
    end_time = models.DateTimeField()
    status = models.CharField(
        max_length=10,
        choices=[('ongoing', 'Ongoing'), ('completed', 'Completed'), ('canceled', 'Canceled')],
        default='ongoing'
    )

    class Meta:
        db_table = 'items'

    def save(self, *args, **kwargs):
        if not self.pk and self.current_price == 0:
            self.current_price = self.starting_price
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name