from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0002_banner_listing_attributes_categoryattribute'),
    ]

    operations = [
        # db_index=True sur les champs simples
        migrations.AlterField(
            model_name='listing',
            name='status',
            field=models.CharField(
                max_length=10,
                choices=[
                    ('draft', 'Brouillon'), ('active', 'Active'),
                    ('sold', 'Vendue'), ('expired', 'Expirée'), ('suspended', 'Suspendue'),
                ],
                default='draft',
                db_index=True,
            ),
        ),
        migrations.AlterField(
            model_name='listing',
            name='city',
            field=models.CharField(max_length=100, default='Conakry', db_index=True),
        ),
        migrations.AlterField(
            model_name='listing',
            name='is_boosted',
            field=models.BooleanField(default=False, db_index=True),
        ),
        # Index composés
        migrations.AddIndex(
            model_name='listing',
            index=models.Index(fields=['status', 'city'], name='listing_status_city_idx'),
        ),
        migrations.AddIndex(
            model_name='listing',
            index=models.Index(fields=['status', 'is_boosted'], name='listing_status_boosted_idx'),
        ),
        migrations.AddIndex(
            model_name='listing',
            index=models.Index(fields=['seller', 'status'], name='listing_seller_status_idx'),
        ),
        migrations.AddIndex(
            model_name='listing',
            index=models.Index(fields=['-created_at'], name='listing_created_at_idx'),
        ),
    ]
