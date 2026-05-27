import random
import string
from django.utils import timezone
from datetime import timedelta


def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))


def otp_expiry(minutes=10):
    return timezone.now() + timedelta(minutes=minutes)