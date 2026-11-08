import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0020_shop_pickup_gps'),
    ]

    operations = [
        # ── ShopReview ────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='ShopReview',
            fields=[
                ('id',         models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('rating',     models.PositiveSmallIntegerField(choices=[(1,'1'),(2,'2'),(3,'3'),(4,'4'),(5,'5')], help_text='Note de 1 à 5 étoiles')),
                ('comment',    models.TextField(blank=True, max_length=500)),
                ('shop',  models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reviews', to='accounts.shop')),
                ('buyer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shop_reviews', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Avis boutique',
                'verbose_name_plural': 'Avis boutiques',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='shopreview',
            constraint=models.UniqueConstraint(fields=['shop', 'buyer'], name='unique_shop_review_per_buyer'),
        ),

        # ── ShopFollow ───────────────────────────────────────────────────────
        migrations.CreateModel(
            name='ShopFollow',
            fields=[
                ('id',         models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('shop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='followers', to='accounts.shop')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='followed_shops', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Suivi boutique',
                'verbose_name_plural': 'Suivis boutiques',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='shopfollow',
            constraint=models.UniqueConstraint(fields=['shop', 'user'], name='unique_shop_follow_per_user'),
        ),
    ]
