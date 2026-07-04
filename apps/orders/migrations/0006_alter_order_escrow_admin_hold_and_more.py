from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Supprime verbose_name et help_text sur escrow_admin_hold et escrow_release_at
    qui étaient présents dans 0004 mais absents dans le modèle actuel.
    """

    dependencies = [
        ('orders', '0005_meetingzone_payment_mtn_momo'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='escrow_admin_hold',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='order',
            name='escrow_release_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
