# apps/bidding/serializers.py
from rest_framework import serializers
from .models import Bid, Item
# Import User và UserSerializer
from apps.auth_users.models import User
from apps.auth_users.serializers import UserSerializer

class Bidserializers(serializers.ModelSerializer):
    # Field để HIỂN THỊ chi tiết user (read-only)
    user_detail = UserSerializer(source='user_id', read_only=True)

    # --- THÊM LẠI FIELD ĐỂ NHẬN INPUT user_id ---
    # Field này dùng để nhận giá trị user_id (là số PK) từ view khi tạo Bid.
    # Nó không hiển thị trong JSON response vì có user_detail rồi.
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),  # Cần queryset để validate ID đầu vào
        write_only=True               # Chỉ dùng để ghi, không hiển thị ra
        # source='user_id' không cần thiết vì tên field trùng tên model field
    )
    # --- KẾT THÚC THÊM ---

    # Field item_id cũng cần tương tự nếu bạn muốn hiển thị item_detail
    # Hiện tại đang mặc định là PrimaryKeyRelatedField (read-write)
    # item_id = serializers.PrimaryKeyRelatedField(queryset=Item.objects.all()) # Mặc định

    # Các field khác giữ nguyên hoặc tùy chỉnh format
    bid_amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)
    bid_time = serializers.DateTimeField(read_only=True) # Format lại nếu muốn

    class Meta:
        model = Bid
        # Liệt kê các field bạn muốn hiển thị trong response (bao gồm cả read-only)
        # Field 'user_id' (write_only) sẽ không nằm trong response, nhưng cần cho việc tạo/cập nhật
        # Đảm bảo 'item_id' cũng có trong fields nếu chưa có, vì nó cần để tạo liên kết
        fields = ['bid_id', 'item_id', 'user_detail', 'bid_amount', 'bid_time', 'user_id']
        # Không cần khai báo read_only_fields ở đây nữa vì đã set trong từng field