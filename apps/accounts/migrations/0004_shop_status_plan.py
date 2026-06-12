from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_shop'),
    ]

    operations = [
        migrations.AddField(
            model_name='shop',
            name='status',
            field=models.CharField(
                max_length=10,
                choices=[
                    ('pending',  'En attente de validation'),
                    ('approved', 'Approuvée'),
                    ('rejected', 'Rejetée'),
                ],
                default='pending',
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name='shop',
            name='plan',
            field=models.CharField(
                max_length=10,
                choices=[
                    ('standard', 'Boutique Standard'),
                    ('premium',  'Boutique Premium'),
                ],
                default='standard',
            ),
        ),
        migrations.AddField(
            model_name='shop',
            name='plan_until',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='shop',
            name='reject_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='shop',
            name='whatsapp',
            field=models.CharField(max_length=20, blank=True),
        ),
        # Les boutiques existantes passent directement à "approved"
        # pour ne pas casser l'existant
        migrations.RunSQL(
            "UPDATE accounts_shop SET status = 'approved' WHERE status = 'pending';",
            reverse_sql="",
        ),
    ]
