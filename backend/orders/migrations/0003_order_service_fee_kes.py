from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0002_order_cancellation_reason"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="service_fee_kes",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
