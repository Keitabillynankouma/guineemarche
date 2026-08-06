from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0006_boostpayment'),
    ]

    operations = [
        migrations.AddField(
            model_name='listing',
            name='boost_expires_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Date de fin du boost payant (séparée de expires_at pour ne pas faire expirer les annonces permanentes)",
            ),
        ),
    ]
