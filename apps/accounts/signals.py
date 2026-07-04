from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, UserProfile, Subscription, Badge


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)
        Subscription.objects.get_or_create(user=instance)
        # Email de bienvenue Brevo
        try:
            from core.email_notifications import send_welcome
            send_welcome(instance)
        except Exception:
            pass

    if not created and instance.is_verified:
        Badge.award(instance, Badge.Type.VERIFIED)