"""initial schema

Revision ID: 26a9e07b6e81
Revises: 
Create Date: 2026-09-30 15:28:18.188658

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '26a9e07b6e81'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.create_table('packages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('session_count', sa.SmallInteger(), nullable=False),
    sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('price >= 0', name=op.f('ck_packages_price_non_negative')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_packages')),
    sa.UniqueConstraint('name', name=op.f('uq_packages_name'))
    )
    op.create_table('therapists',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('full_name', sa.String(length=120), nullable=False),
    sa.Column('specialty', sa.String(length=120), nullable=False),
    sa.Column('phone', sa.String(length=32), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('working_days', sa.ARRAY(sa.SmallInteger()), nullable=False),
    sa.Column('start_time', sa.Time(), nullable=False),
    sa.Column('end_time', sa.Time(), nullable=False),
    sa.Column('slot_minutes', sa.SmallInteger(), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('end_time > start_time', name=op.f('ck_therapists_working_hours_order')),
    sa.CheckConstraint('slot_minutes BETWEEN 10 AND 240', name=op.f('ck_therapists_slot_minutes_range')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_therapists'))
    )
    op.create_index(op.f('ix_therapists_is_active'), 'therapists', ['is_active'], unique=False)
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('full_name', sa.String(length=120), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('role', sa.Enum('admin', 'staff', name='user_role'), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users'))
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_table('patients',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('full_name', sa.String(length=120), nullable=False),
    sa.Column('phone', sa.String(length=32), nullable=False),
    sa.Column('age', sa.Integer(), nullable=False),
    sa.Column('gender', sa.Enum('male', 'female', 'other', name='gender'), nullable=False),
    sa.Column('address', sa.String(length=255), nullable=True),
    sa.Column('condition', sa.String(length=200), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('status', sa.Enum('active', 'on_hold', 'completed', name='patient_status'), nullable=False),
    sa.Column('therapist_id', sa.Integer(), nullable=True),
    sa.Column('package_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('age BETWEEN 0 AND 130', name=op.f('ck_patients_age_range')),
    sa.ForeignKeyConstraint(['package_id'], ['packages.id'], name=op.f('fk_patients_package_id_packages'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['therapist_id'], ['therapists.id'], name=op.f('fk_patients_therapist_id_therapists'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_patients'))
    )
    op.create_index(op.f('ix_patients_full_name'), 'patients', ['full_name'], unique=False)
    op.create_index(op.f('ix_patients_phone'), 'patients', ['phone'], unique=False)
    op.create_index(op.f('ix_patients_status'), 'patients', ['status'], unique=False)
    op.create_index(op.f('ix_patients_therapist_id'), 'patients', ['therapist_id'], unique=False)
    op.create_table('refresh_tokens',
    sa.Column('jti', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('replaced_by', sa.UUID(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_refresh_tokens_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('jti', name=op.f('pk_refresh_tokens'))
    )
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)
    op.create_table('therapist_overrides',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('therapist_id', sa.Integer(), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('is_off', sa.Boolean(), nullable=False),
    sa.Column('start_time', sa.Time(), nullable=True),
    sa.Column('end_time', sa.Time(), nullable=True),
    sa.Column('reason', sa.String(length=200), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('(is_off AND start_time IS NULL AND end_time IS NULL) OR (NOT is_off AND start_time IS NOT NULL AND end_time > start_time)', name=op.f('ck_therapist_overrides_off_or_valid_hours')),
    sa.ForeignKeyConstraint(['therapist_id'], ['therapists.id'], name=op.f('fk_therapist_overrides_therapist_id_therapists'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_therapist_overrides')),
    sa.UniqueConstraint('therapist_id', 'date', name='uq_therapist_overrides_therapist_date')
    )
    op.create_table('appointments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('patient_id', sa.Integer(), nullable=False),
    sa.Column('therapist_id', sa.Integer(), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('start_time', sa.Time(), nullable=False),
    sa.Column('end_time', sa.Time(), nullable=False),
    sa.Column('status', sa.Enum('booked', 'completed', 'cancelled', 'no_show', name='appointment_status'), nullable=False),
    sa.Column('session_type', sa.Enum('assessment', 'treatment', 'follow_up', name='session_type'), nullable=False),
    sa.Column('payment_method', sa.Enum('cash', 'card', 'bank_transfer', 'digital_wallet', 'package', name='payment_method'), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    postgresql.ExcludeConstraint((sa.column('patient_id'), '='), (sa.text('tsrange(date + start_time, date + end_time)'), '&&'), where=sa.text("status <> 'cancelled'"), using='gist', name='ex_appointments_patient_no_overlap'),
    postgresql.ExcludeConstraint((sa.column('therapist_id'), '='), (sa.text('tsrange(date + start_time, date + end_time)'), '&&'), where=sa.text("status <> 'cancelled'"), using='gist', name='ex_appointments_therapist_no_overlap'),
    sa.CheckConstraint('end_time > start_time', name=op.f('ck_appointments_time_order')),
    sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], name=op.f('fk_appointments_patient_id_patients'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['therapist_id'], ['therapists.id'], name=op.f('fk_appointments_therapist_id_therapists'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_appointments'))
    )
    op.create_index('ix_appointments_date_therapist', 'appointments', ['date', 'therapist_id'], unique=False)
    op.create_index(op.f('ix_appointments_patient_id'), 'appointments', ['patient_id'], unique=False)
    op.create_table('invoices',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('patient_id', sa.Integer(), nullable=True),
    sa.Column('patient_name', sa.String(length=120), nullable=False),
    sa.Column('appointment_id', sa.Integer(), nullable=True),
    sa.Column('package_id', sa.Integer(), nullable=True),
    sa.Column('service', sa.String(length=160), nullable=False),
    sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('discount', sa.Numeric(precision=10, scale=2), server_default='0', nullable=False),
    sa.Column('total', sa.Numeric(precision=10, scale=2), sa.Computed('amount - discount', persisted=True), nullable=False),
    sa.Column('status', sa.Enum('paid', 'due', 'void', name='invoice_status'), nullable=False),
    sa.Column('payment_method', sa.Enum('cash', 'card', 'bank_transfer', 'digital_wallet', 'package', name='payment_method'), nullable=True),
    sa.Column('issued_on', sa.Date(), nullable=False),
    sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("(status = 'paid') = (paid_at IS NOT NULL)", name=op.f('ck_invoices_paid_at_matches_status')),
    sa.CheckConstraint('amount >= 0', name=op.f('ck_invoices_amount_non_negative')),
    sa.CheckConstraint('discount >= 0 AND discount <= amount', name=op.f('ck_invoices_discount_range')),
    sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], name=op.f('fk_invoices_appointment_id_appointments'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['package_id'], ['packages.id'], name=op.f('fk_invoices_package_id_packages'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], name=op.f('fk_invoices_patient_id_patients'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_invoices'))
    )
    op.create_index(op.f('ix_invoices_issued_on'), 'invoices', ['issued_on'], unique=False)
    op.create_index(op.f('ix_invoices_paid_at'), 'invoices', ['paid_at'], unique=False)
    op.create_index(op.f('ix_invoices_patient_id'), 'invoices', ['patient_id'], unique=False)
    op.create_index(op.f('ix_invoices_status'), 'invoices', ['status'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_invoices_status'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_patient_id'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_paid_at'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_issued_on'), table_name='invoices')
    op.drop_table('invoices')
    op.drop_index(op.f('ix_appointments_patient_id'), table_name='appointments')
    op.drop_index('ix_appointments_date_therapist', table_name='appointments')
    op.drop_table('appointments')
    op.drop_table('therapist_overrides')
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
    op.drop_index(op.f('ix_patients_therapist_id'), table_name='patients')
    op.drop_index(op.f('ix_patients_status'), table_name='patients')
    op.drop_index(op.f('ix_patients_phone'), table_name='patients')
    op.drop_index(op.f('ix_patients_full_name'), table_name='patients')
    op.drop_table('patients')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_therapists_is_active'), table_name='therapists')
    op.drop_table('therapists')
    op.drop_table('packages')
    for enum_name in (
        "user_role", "gender", "patient_status", "appointment_status",
        "session_type", "payment_method", "invoice_status",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")



    # ### end Alembic commands ###
