from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_sitesettings_auto_approve_livreur_pct'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectTask',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('todo', 'À faire'), ('in_progress', 'En cours'), ('done', 'Terminé')], default='todo', max_length=20)),
                ('assignee', models.CharField(blank=True, max_length=100)),
                ('priority', models.CharField(choices=[('low', 'Faible'), ('medium', 'Moyen'), ('high', 'Élevé')], default='medium', max_length=20)),
                ('position', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['position', '-created_at']},
        ),
        migrations.CreateModel(
            name='ProjectNote',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('content', models.TextField()),
                ('author_name', models.CharField(blank=True, max_length=100)),
                ('pinned', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['-pinned', '-created_at']},
        ),
        migrations.CreateModel(
            name='ProjectMilestone',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('phase', models.CharField(blank=True, max_length=100)),
                ('status', models.CharField(choices=[('planned', 'Prévu'), ('in_progress', 'En cours'), ('done', 'Terminé'), ('cancelled', 'Annulé')], default='planned', max_length=20)),
                ('target_date', models.DateField(blank=True, null=True)),
                ('position', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['position', 'target_date']},
        ),
        migrations.CreateModel(
            name='TeamMember',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('role', models.CharField(max_length=100)),
                ('email', models.CharField(blank=True, max_length=200)),
                ('phone', models.CharField(blank=True, max_length=50)),
                ('responsibilities', models.TextField(blank=True)),
                ('avatar_emoji', models.CharField(default='👤', max_length=10)),
                ('active', models.BooleanField(default=True)),
                ('position', models.IntegerField(default=0)),
            ],
            options={'ordering': ['position']},
        ),
    ]
