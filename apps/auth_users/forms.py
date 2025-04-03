from django import forms
from allauth.account.forms import SignupForm
from .models import User

class CustomSignupForm(SignupForm):
    profile_picture = forms.ImageField(required=False)

    def save(self, request):
        user = super().save(request)
        if self.cleaned_data['profile_picture']:
            user.profile_picture = self.cleaned_data['profile_picture']
            user.save()
        return user