from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0004_listingmedia_filefield'),
    ]

    operations = [
        migrations.AddField(
            model_name='listing',
            name='weight_kg',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=6, null=True,
                help_text='Poids en kg — utilisé pour calculer les frais de livraison'
            ),
        ),
    ]
