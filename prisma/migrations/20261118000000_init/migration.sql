-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ControlCategory" AS ENUM ('SELF_WORK', 'BORDER_CONTROL', 'EXTRA');

-- CreateTable
CREATE TABLE "faculties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "faculties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplines" (
    "id" TEXT NOT NULL,
    "department_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discipline_programs" (
    "id" TEXT NOT NULL,
    "discipline_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discipline_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "gaudi_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "gaudi_id" TEXT NOT NULL,
    "program_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_code" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_curators" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "user_group_curators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "gaudi_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SCHEDULE',
    "schedule_external_id" TEXT NOT NULL,
    "gaudi_id" TEXT,
    "discipline_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "semester_id" TEXT,
    "out_of_semester" BOOLEAN NOT NULL DEFAULT false,
    "semester_resolution_status" TEXT,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "status_v2" TEXT,
    "opened_at" TIMESTAMPTZ(6),
    "flag_late_teacher" BOOLEAN NOT NULL DEFAULT false,
    "geo_latitude" DOUBLE PRECISION,
    "geo_longitude" DOUBLE PRECISION,
    "geo_accuracy" DOUBLE PRECISION,
    "geo_timestamp" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "class_session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "status" TEXT,
    "status_v2" TEXT,
    "gaudi_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "updated_by" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" JSONB,

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "total_points" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "module_points" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "extra_max_points" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "locked_at" TIMESTAMPTZ(6),
    "module1_closed_at" TIMESTAMPTZ(6),
    "module2_closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_trail" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" TEXT,
    "after_json" TEXT,

    CONSTRAINT "audit_trail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gaudi_role_mappings" (
    "id" TEXT NOT NULL,
    "gaudi_role" TEXT NOT NULL,
    "ejp_role" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gaudi_role_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_dlq" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "error_code" TEXT NOT NULL,
    "error_message" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_retry_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "correlation_id" TEXT,
    "last_error_at" TIMESTAMPTZ(6),
    "last_error_stack" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_dlq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_cards" (
    "id" TEXT NOT NULL,
    "discipline_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "late_percent" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "extra_max_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tech_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_card_modules" (
    "id" TEXT NOT NULL,
    "tech_card_id" TEXT NOT NULL,
    "module_no" INTEGER NOT NULL,
    "lessons_count" INTEGER NOT NULL DEFAULT 0,
    "attendance_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "self_work_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "current_control_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "border_control_points" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "tech_card_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_card_lessons" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "lesson_no" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "tech_card_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_scores" (
    "id" TEXT NOT NULL,
    "class_session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "entered_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lesson_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_scores" (
    "id" TEXT NOT NULL,
    "tech_card_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "category" "ControlCategory" NOT NULL,
    "module_no" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL,
    "entered_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "control_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_program_heads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_program_heads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faculties_code_key" ON "faculties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_faculty_id_name_key" ON "departments"("faculty_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "programs_faculty_department_name_key" ON "programs"("faculty_id", "department_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "disciplines_code_key" ON "disciplines"("code");

-- CreateIndex
CREATE INDEX "disciplines_department_id_idx" ON "disciplines"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "disciplines_department_name_key" ON "disciplines"("department_id", "name");

-- CreateIndex
CREATE INDEX "discipline_programs_discipline_id_idx" ON "discipline_programs"("discipline_id");

-- CreateIndex
CREATE INDEX "discipline_programs_program_id_idx" ON "discipline_programs"("program_id");

-- CreateIndex
CREATE UNIQUE INDEX "discipline_programs_discipline_program_key" ON "discipline_programs"("discipline_id", "program_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_gaudi_id_key" ON "teachers"("gaudi_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_gaudi_id_key" ON "groups"("gaudi_id");

-- CreateIndex
CREATE INDEX "groups_program_id_idx" ON "groups"("program_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_program_code_key" ON "groups"("program_id", "code");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "user_roles_user_is_active_idx" ON "user_roles"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "user_roles_source_idx" ON "user_roles"("source");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_role_source_key" ON "user_roles"("user_id", "role_code", "source");

-- CreateIndex
CREATE INDEX "user_group_curators_user_id_idx" ON "user_group_curators"("user_id");

-- CreateIndex
CREATE INDEX "user_group_curators_group_id_idx" ON "user_group_curators"("group_id");

-- CreateIndex
CREATE INDEX "user_group_curators_is_active_idx" ON "user_group_curators"("is_active");

-- CreateIndex
CREATE INDEX "user_group_curators_deleted_at_idx" ON "user_group_curators"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_curators_user_group_key" ON "user_group_curators"("user_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_gaudi_id_key" ON "students"("gaudi_id");

-- CreateIndex
CREATE INDEX "students_group_id_idx" ON "students"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_gaudi_id_key" ON "class_sessions"("gaudi_id");

-- CreateIndex
CREATE INDEX "idx_class_sessions_out_of_semester" ON "class_sessions"("out_of_semester");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_source_schedule_external_id_key" ON "class_sessions"("source", "schedule_external_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_gaudi_id_key" ON "attendances"("gaudi_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_class_session_id_student_id_key" ON "attendances"("class_session_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "gaudi_role_mappings_gaudi_role_key" ON "gaudi_role_mappings"("gaudi_role");

-- CreateIndex
CREATE INDEX "gaudi_role_mappings_is_active_idx" ON "gaudi_role_mappings"("is_active");

-- CreateIndex
CREATE INDEX "gaudi_role_mappings_priority_idx" ON "gaudi_role_mappings"("priority");

-- CreateIndex
CREATE INDEX "integration_dlq_provider_operation_idx" ON "integration_dlq"("provider", "operation");

-- CreateIndex
CREATE INDEX "integration_dlq_status_next_retry_at_idx" ON "integration_dlq"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "integration_dlq_correlation_id_idx" ON "integration_dlq"("correlation_id");

-- CreateIndex
CREATE INDEX "tech_cards_teacher_id_idx" ON "tech_cards"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "tech_cards_discipline_id_program_id_semester_id_teacher_id_key" ON "tech_cards"("discipline_id", "program_id", "semester_id", "teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "tech_card_modules_tech_card_id_module_no_key" ON "tech_card_modules"("tech_card_id", "module_no");

-- CreateIndex
CREATE UNIQUE INDEX "tech_card_lessons_module_id_lesson_no_key" ON "tech_card_lessons"("module_id", "lesson_no");

-- CreateIndex
CREATE INDEX "lesson_scores_student_id_idx" ON "lesson_scores"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_scores_class_session_id_student_id_key" ON "lesson_scores"("class_session_id", "student_id");

-- CreateIndex
CREATE INDEX "control_scores_student_id_idx" ON "control_scores"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "control_scores_tech_card_id_student_id_category_module_no_key" ON "control_scores"("tech_card_id", "student_id", "category", "module_no");

-- CreateIndex
CREATE INDEX "user_program_heads_user_id_idx" ON "user_program_heads"("user_id");

-- CreateIndex
CREATE INDEX "user_program_heads_program_id_idx" ON "user_program_heads"("program_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_program_heads_user_program_key" ON "user_program_heads"("user_id", "program_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplines" ADD CONSTRAINT "disciplines_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discipline_programs" ADD CONSTRAINT "discipline_programs_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discipline_programs" ADD CONSTRAINT "discipline_programs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_curators" ADD CONSTRAINT "user_group_curators_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_curators" ADD CONSTRAINT "user_group_curators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_cards" ADD CONSTRAINT "tech_cards_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_cards" ADD CONSTRAINT "tech_cards_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_cards" ADD CONSTRAINT "tech_cards_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_cards" ADD CONSTRAINT "tech_cards_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_card_modules" ADD CONSTRAINT "tech_card_modules_tech_card_id_fkey" FOREIGN KEY ("tech_card_id") REFERENCES "tech_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_card_lessons" ADD CONSTRAINT "tech_card_lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "tech_card_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_scores" ADD CONSTRAINT "lesson_scores_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_scores" ADD CONSTRAINT "lesson_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_scores" ADD CONSTRAINT "control_scores_tech_card_id_fkey" FOREIGN KEY ("tech_card_id") REFERENCES "tech_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_scores" ADD CONSTRAINT "control_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_program_heads" ADD CONSTRAINT "user_program_heads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_program_heads" ADD CONSTRAINT "user_program_heads_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

