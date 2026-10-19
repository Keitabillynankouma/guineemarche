import uuid
from django.db import models
from core.site_settings import SiteSettings  # noqa — importé pour que Django le découvre


class BaseModel(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ── Suivi projet interne ──────────────────────────────────────────────────────

class ProjectTask(models.Model):
    STATUS_CHOICES  = [('todo', 'À faire'), ('in_progress', 'En cours'), ('done', 'Terminé')]
    PRIORITY_CHOICES = [('low', 'Faible'), ('medium', 'Moyen'), ('high', 'Élevé')]

    title       = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='todo')
    assignee    = models.CharField(max_length=100, blank=True)
    priority    = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    position    = models.IntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position', '-created_at']

    def __str__(self):
        return self.title


class ProjectNote(models.Model):
    title       = models.CharField(max_length=200)
    content     = models.TextField()
    author_name = models.CharField(max_length=100, blank=True)
    pinned      = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-pinned', '-created_at']

    def __str__(self):
        return self.title


class ProjectMilestone(models.Model):
    STATUS_CHOICES = [
        ('planned',     'Prévu'),
        ('in_progress', 'En cours'),
        ('done',        'Terminé'),
        ('cancelled',   'Annulé'),
    ]

    title       = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    phase       = models.CharField(max_length=100, blank=True)
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    target_date = models.DateField(null=True, blank=True)
    position    = models.IntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position', 'target_date']

    def __str__(self):
        return self.title


class TeamMember(models.Model):
    name             = models.CharField(max_length=100)
    role             = models.CharField(max_length=100)
    email            = models.CharField(max_length=200, blank=True)
    phone            = models.CharField(max_length=50, blank=True)
    responsibilities = models.TextField(blank=True)
    avatar_emoji     = models.CharField(max_length=10, default='👤')
    active           = models.BooleanField(default=True)
    position         = models.IntegerField(default=0)

    class Meta:
        ordering = ['position']

    def __str__(self):
        return self.name