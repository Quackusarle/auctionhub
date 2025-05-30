# views.py
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User
from .serializers import UserSerializer
from rest_framework.parsers import MultiPartParser, FormParser
from django.templatetags.static import static
from django.urls import reverse
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
import cloudinary.uploader

# View để lấy danh sách User (Thường chỉ dành cho Admin)
class UserList(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

class UserDetail(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get_object(self, pk):
        return get_object_or_404(User, pk=pk) 

    def get(self, request, pk):
        user = self.get_object(pk)
        serializer = UserSerializer(user)
        return Response(serializer.data)

    def put(self, request, pk):
        user = self.get_object(pk)
        serializer = UserSerializer(user, data=request.data) 
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        user = self.get_object(pk)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = UserSerializer(user, context={'request': request}) 
        return Response(serializer.data)

DEFAULT_AVATAR_STATIC_PATH = '/images/default_avatar.jpg'

class GetProfilePictureView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        profile_url = request.build_absolute_uri(reverse('users:profile-me'))

        # Cloudinary: profile_picture là URL string
        avatar_url = user.profile_picture if user.profile_picture else None

        if not avatar_url:
            try:
                avatar_url = request.build_absolute_uri(static(DEFAULT_AVATAR_STATIC_PATH))
            except Exception as e:
                print(f"Lỗi khi lấy static URL cho ảnh mặc định: {e}")
                avatar_url = None

        return Response({
            'avatarUrl': avatar_url,
            'profileUrl': profile_url
        }, status=status.HTTP_200_OK)

class ProfilePictureUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, format=None):
        user = request.user

        if 'profile_picture' not in request.FILES:
            return Response({'detail': 'Không tìm thấy file ảnh nào.'}, status=status.HTTP_400_BAD_REQUEST)

        file_obj = request.FILES['profile_picture']

        if file_obj.size > 5 * 1024 * 1024:
            return Response({'detail': 'Kích thước file quá lớn (tối đa 5MB).'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.content_type.startswith('image'):
            return Response({'detail': 'Định dạng file không hợp lệ. Chỉ chấp nhận file ảnh.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_result = cloudinary.uploader.upload(file_obj, folder="profile_pictures")
            user.profile_picture = upload_result.get('secure_url')
            user.save()
        except Exception as e:
            return Response({'detail': f'Lỗi khi upload ảnh lên Cloudinary: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = UserSerializer(user, context={'request': request})
        return Response({'detail': 'Upload ảnh đại diện thành công!', 'profile_picture_url': serializer.data.get('profile_picture')}, status=status.HTTP_200_OK)

class DeleteCurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        user = request.user
        user.delete()
        return Response({'detail': 'Tài khoản đã được xóa thành công.'}, status=status.HTTP_204_NO_CONTENT)