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

install:
	pip install -r requirements.txt

freeze:
	pip freeze > requirements.txt

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

collectstatic:
	python manage.py collectstatic --no-input

deploy-check:
	python manage.py check --deploy
