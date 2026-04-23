-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gaudi_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gaudi_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "students_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_external_id" TEXT NOT NULL,
    "gaudi_id" TEXT,
    "discipline_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "status_v2" TEXT,
    "opened_at" DATETIME,
    "flag_late_teacher" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "class_sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "class_sessions_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" TEXT,
    "status_v2" TEXT,
    "gaudi_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" DATETIME,
    "updated_by" TEXT,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendances_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "attendances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "audit_trail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" TEXT,
    "after_json" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "groups_gaudi_id_key" ON "groups"("gaudi_id");

-- CreateIndex
CREATE INDEX "groups_updated_at_idx" ON "groups"("updated_at");

-- CreateIndex
CREATE INDEX "groups_is_active_idx" ON "groups"("is_active");

-- CreateIndex
CREATE INDEX "groups_deleted_at_idx" ON "groups"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "students_gaudi_id_key" ON "students"("gaudi_id");

-- CreateIndex
CREATE INDEX "students_group_id_idx" ON "students"("group_id");

-- CreateIndex
CREATE INDEX "students_updated_at_idx" ON "students"("updated_at");

-- CreateIndex
CREATE INDEX "students_is_active_idx" ON "students"("is_active");

-- CreateIndex
CREATE INDEX "students_deleted_at_idx" ON "students"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_schedule_external_id_key" ON "class_sessions"("schedule_external_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_gaudi_id_key" ON "class_sessions"("gaudi_id");

-- CreateIndex
CREATE INDEX "class_sessions_group_id_idx" ON "class_sessions"("group_id");

-- CreateIndex
CREATE INDEX "class_sessions_semester_id_idx" ON "class_sessions"("semester_id");

-- CreateIndex
CREATE INDEX "class_sessions_start_time_idx" ON "class_sessions"("start_time");

-- CreateIndex
CREATE INDEX "class_sessions_end_time_idx" ON "class_sessions"("end_time");

-- CreateIndex
CREATE INDEX "class_sessions_status_idx" ON "class_sessions"("status");

-- CreateIndex
CREATE INDEX "class_sessions_status_v2_idx" ON "class_sessions"("status_v2");

-- CreateIndex
CREATE INDEX "class_sessions_updated_at_idx" ON "class_sessions"("updated_at");

-- CreateIndex
CREATE INDEX "class_sessions_is_active_idx" ON "class_sessions"("is_active");

-- CreateIndex
CREATE INDEX "class_sessions_deleted_at_idx" ON "class_sessions"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_gaudi_id_key" ON "attendances"("gaudi_id");

-- CreateIndex
CREATE INDEX "attendances_student_id_idx" ON "attendances"("student_id");

-- CreateIndex
CREATE INDEX "attendances_class_session_id_idx" ON "attendances"("class_session_id");

-- CreateIndex
CREATE INDEX "attendances_status_idx" ON "attendances"("status");

-- CreateIndex
CREATE INDEX "attendances_status_v2_idx" ON "attendances"("status_v2");

-- CreateIndex
CREATE INDEX "attendances_updated_at_idx" ON "attendances"("updated_at");

-- CreateIndex
CREATE INDEX "attendances_class_session_id_status_idx" ON "attendances"("class_session_id", "status");

-- CreateIndex
CREATE INDEX "attendances_is_active_idx" ON "attendances"("is_active");

-- CreateIndex
CREATE INDEX "attendances_deleted_at_idx" ON "attendances"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_class_session_id_student_id_key" ON "attendances"("class_session_id", "student_id");

-- CreateIndex
CREATE INDEX "semesters_start_date_idx" ON "semesters"("start_date");

-- CreateIndex
CREATE INDEX "semesters_end_date_idx" ON "semesters"("end_date");

-- CreateIndex
CREATE INDEX "semesters_is_locked_idx" ON "semesters"("is_locked");

-- CreateIndex
CREATE INDEX "audit_trail_created_at_idx" ON "audit_trail"("created_at");

-- CreateIndex
CREATE INDEX "audit_trail_actor_type_created_at_idx" ON "audit_trail"("actor_type", "created_at");

-- CreateIndex
CREATE INDEX "audit_trail_entity_type_entity_id_created_at_idx" ON "audit_trail"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_trail_action_created_at_idx" ON "audit_trail"("action", "created_at");

