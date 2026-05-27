run:
	python manage.py runserver

migrate:
	python manage.py makemigrations && python manage.py migrate

shell:
	python manage.py shell_plus

test:
	python manage.py test

superuser:
	python manage.py createsuperuser

freeze:
	pip freeze > requirements/base.txt