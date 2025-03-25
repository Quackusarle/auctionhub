from django.shortcuts import render  # Import render
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers
from .models import User
from django.conf import settings
from .serializers import *
from django.core.mail import send_mail
import pyotp
from rest_framework_simplejwt.tokens import RefreshToken    
from django.contrib.auth.hashers import check_password, make_password

# Create your views here.

class UserList(APIView):
    
    def get(self, request):
        users = User.objects.all()
        serializer = userSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = userSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class UserDetail(APIView):
    def get_object(self, username):
        try:
            return User.objects.get(username=username)
        except User.DoesNotExist:
            return None
    
    def get(self, request, pk):
        user = self.get_object(pk)
        if user:
            serializer = userSerializer(user)
            return Response(serializer.data)
        else:
            return Response(status=status.HTTP_404_NOT_FOUND)
    
    def put(self, request, pk):
        user = self.get_object(pk)
        if user:
            serializer = userSerializer(user, data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    def delete(self, request, pk):
        user = self.get_object(pk)
        if user:
            user.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(status=status.HTTP_404_NOT_FOUND)
    

class RegisterView(APIView):
    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            self.send_otp_email(user)  # Gửi OTP ngay sau khi đăng ký
            return Response(
                {"message": "OTP đã được gửi đến email của bạn."},
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def send_otp_email(self, user):
        totp = pyotp.TOTP(user.otp_secret, interval=300)  # OTP hết hạn sau 5 phút
        otp_code = totp.now()
        send_mail(
            subject='Xác thực tài khoản',
            message=f'Mã OTP của bạn là: {otp_code}',
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[user.email],
            fail_silently=False,
        )

class VerifyOTPView(APIView):
    def post(self, request):
        print("Request data:", request.data)  # Debug dữ liệu nhận được
        serializer = VerifyOTPSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            otp = serializer.validated_data['otp']
            
            try:
                user = User.objects.get(email=email)
                totp = pyotp.TOTP(user.otp_secret, interval=300)
                print(f"Generated OTP for {email}: {totp.now()}")  # Debug OTP
                if totp.verify(otp):
                    user.is_verified = True
                    user.save()
                    return Response(
                        {"message": "Xác thực thành công!"},
                        status=status.HTTP_200_OK
                    )
                return Response(
                    {"error": "Mã OTP không hợp lệ hoặc đã hết hạn."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except User.DoesNotExist:
                return Response(
                    {"error": "Người dùng không tồn tại."},
                    status=status.HTTP_404_NOT_FOUND
                )
        print("Serializer errors:", serializer.errors)  # Debug lỗi serializer
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']
            user = User.objects.filter(email=email).first()

            if user and user.check_password(password):
                if not user.is_verified:
                    return Response(
                        {"error": "Tài khoản chưa được xác thực."},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
                # Tạo token JWT
                refresh = RefreshToken.for_user(user)
                return Response({
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                })
            return Response(
                {"error": "Thông tin đăng nhập không chính xác."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class ResendOTPView(APIView):
    def post(self, request):
        email = request.data.get('email')
        try:
            user = User.objects.get(email=email)
            if user.is_verified:
                return Response(
                    {"error": "Tài khoản đã được xác thực."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Gửi lại OTP
            RegisterView().send_otp_email(user)
            return Response(
                {"message": "Đã gửi lại mã OTP."},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            return Response(
                {"error": "Email không tồn tại."},
                status=status.HTTP_404_NOT_FOUND
            )

class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not check_password(serializer.validated_data['old_password'], user.password):
                return Response({"error": "Mật khẩu cũ không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
            user.password = make_password(serializer.validated_data['new_password'])
            user.save()
            return Response({"message": "Thay đổi mật khẩu thành công"}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ResetPasswordView(APIView):
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = User.objects.get(email=serializer.validated_data['email'])
                user.password = make_password(serializer.validated_data['new_password'])
                user.save()
                return Response({"message": "Thay đổi mật khẩu thành công"}, status=status.HTTP_200_OK)
            except User.DoesNotExist:
                return Response({"error": "Người dùng với email này không tồn tại"}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(APIView):
    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response({"error": "Refresh token required !?"}, status=status.HTTP_400_BAD_REQUEST)
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Logout thành công"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": "Token không hợp lệ hoặc đã bị đưa vào blacklist"}, status=status.HTTP_400_BAD_REQUEST)

# Render templates for login, register, verify OTP
def register_template(request):
    return render(request, 'auth_users/register.html')

def login_template(request):
    return render(request, 'auth_users/login.html')

def verify_otp_template(request):
    return render(request, 'auth_users/verify_otp.html')