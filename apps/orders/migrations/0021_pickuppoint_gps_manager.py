from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0020_capital_vendor_advance'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='pickuppoint',
            name='latitude',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='pickuppoint',
            name='longitude',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='pickuppoint',
            name='opening_hours',
            field=models.CharField(blank=True, help_text='Ex: Lun-Sam 8h-18h', max_length=200),
        ),
        migrations.AddField(
            model_name='pickuppoint',
            name='manager',
            field=models.OneToOneField(
                blank=True,
                limit_choices_to={'role': 'point_retrait_manager'},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='managed_pickup_point',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
