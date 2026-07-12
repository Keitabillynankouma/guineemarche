"""Permet la notation 3-way : unique_together sur (order, reviewer, reviewee) au lieu de (order, reviewer)."""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('reviews', '0001_initial'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='review',
            unique_together={('order', 'reviewer', 'reviewee')},
        ),
    ]
