export class RecurringTaskDto {
    static toResponse(task) {
        return {
            id: task.id,
            client_id: task.client_id,
            office_id: task.office_id,
            location: task.location,
            location_detail: task.location_detail,
            status: task.status,
            request_type: task.request_type,
            recurrence_type: task.recurrence_type,
            recurring_status: task.recurring_status,
            recurrence_interval: task.recurrence_interval,
            next_due_date: task.next_due_date,
            last_completed_date: task.last_completed_date,
            created_date: task.created_date,
            planned_date: task.planned_date,
            client: task.client ? {
                id: task.client.id,
                name: task.client.full_name,
                phone: task.client.phone
            } : null,
            office: task.office ? {
                id: task.office.id,
                name: task.office.name
            } : null,
            executors: task.requests && task.requests.length > 0 ? 
                task.requests[0].requestExecutors ? 
                    task.requests[0].requestExecutors.map(re => ({
                        id: re.executor.user.id,
                        full_name: re.executor.user.full_name,
                        phone: re.executor.user.phone
                    })) : [] : [],
            taskInstances: task.taskInstances ? task.taskInstances.map(instance => ({
                id: instance.id,
                due_date: instance.due_date,
                completed_date: instance.completed_date,
                status: instance.status,
                notes: instance.notes,
                completed_by: instance.completedByUser ? {
                    id: instance.completedByUser.id,
                    name: instance.completedByUser.full_name,
                    phone: instance.completedByUser.phone
                } : null
            })) : [],
            requests: task.requests ? task.requests.map(request => ({
                id: request.id,
                title: request.title,
                description: request.description,
                status: request.status,
                category_id: request.category_id,
                // Убираем is_long_term для повторяющихся задач
                category: request.category ? {
                    id: request.category.id,
                    name: request.category.name
                } : null,
                requestExecutors: request.requestExecutors ? request.requestExecutors.map(re => ({
                    id: re.id,
                    request_id: re.request_id,
                    executor_id: re.executor_id,
                    role: re.role,
                    executor: re.executor ? {
                        id: re.executor.id,
                        user_id: re.executor.user_id,
                        department_id: re.executor.department_id,
                        specialty: re.executor.specialty,
                        user: re.executor.user ? {
                            id: re.executor.user.id,
                            full_name: re.executor.user.full_name,
                            phone: re.executor.user.phone
                        } : null
                    } : null
                })) : []
            })) : [],
            photos: task.photos ? task.photos.map(photo => ({
                id: photo.id,
                photo_url: photo.photo_url,
                type: photo.type
            })) : []
        };
    }

    static toListResponse(tasks) {
        return {
            tasks: tasks.tasks.map(task => this.toResponse(task)),
            pagination: tasks.pagination
        };
    }

    static toInstanceResponse(instance) {
        return {
            id: instance.id,
            request_group_id: instance.request_group_id,
            due_date: instance.due_date,
            completed_date: instance.completed_date,
            status: instance.status,
            notes: instance.notes,
            created_date: instance.created_date,
            updated_date: instance.updated_date,
            completed_by: instance.completedByUser ? {
                id: instance.completedByUser.id,
                name: instance.completedByUser.full_name,
                phone: instance.completedByUser.phone
            } : null
        };
    }

    static toInstanceListResponse(instances) {
        return {
            instances: instances.instances.map(instance => this.toInstanceResponse(instance)),
            pagination: instances.pagination
        };
    }

    static toStatsResponse(stats) {
        return {
            total_instances: stats.total_instances,
            completed_instances: stats.completed_instances,
            pending_instances: stats.pending_instances,
            overdue_instances: stats.overdue_instances,
            completion_rate: stats.completion_rate
        };
    }

    static toCalendarResponse(calendarItems) {
        return calendarItems.map(item => ({
            id: item.id,
            due_date: item.due_date,
            status: item.status,
            requestGroup: item.requestGroup ? {
                id: item.requestGroup.id,
                location: item.requestGroup.location,
                location_detail: item.requestGroup.location_detail,
                recurrence_type: item.requestGroup.recurrence_type,
                recurrence_interval: item.requestGroup.recurrence_interval,
                client: item.requestGroup.client ? {
                    id: item.requestGroup.client.id,
                    name: item.requestGroup.client.full_name,
                    phone: item.requestGroup.client.phone
                } : null
            } : null
        }));
    }
}

export default RecurringTaskDto;
