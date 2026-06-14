from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0003_listing_indexes'),
    ]

    operations = [
        migrations.AlterField(
            model_name='listingmedia',
            name='file',
            field=models.FileField(upload_to='listings/%Y/%m/'),
        ),
    ]
