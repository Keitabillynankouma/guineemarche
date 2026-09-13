from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0008_listing_delivery_modes'),
    ]

    operations = [
        migrations.AddField(
            model_name='listing',
            name='stock_qty',
            field=models.PositiveIntegerField(
                blank=True, null=True,
                help_text='Quantité en stock. Null = illimité. 0 = rupture (annonce gardée mais non commandable).',
            ),
        ),
    ]
