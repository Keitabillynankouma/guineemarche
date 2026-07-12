from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_user_is_available'),
    ]

    operations = [
        migrations.CreateModel(
            name='AdminUser',
            fields=[],
            options={
                'verbose_name': 'Administrateur',
                'verbose_name_plural': 'Équipe Admin',
                'ordering': ['-last_login'],
                'proxy': True,
                'indexes': [],
                'constraints': [],
            },
            bases=('accounts.user',),
        ),
    ]
