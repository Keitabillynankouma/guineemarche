web: python manage.py makemigrations --noinput && python manage.py migrate --noinput && mkdir -p staticfiles && python manage.py collectstatic --noinput && gunicorn config.wsgi --bind 0.0.0.0:$PORT
