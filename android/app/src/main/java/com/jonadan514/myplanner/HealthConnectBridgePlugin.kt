package com.jonadan514.myplanner

import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "HealthConnectBridge")
class HealthConnectBridgePlugin : Plugin() {
    private val samsungHealthOrigin = DataOrigin("com.sec.android.app.shealth")
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var permissionLauncher: ActivityResultLauncher<Set<String>>
    private var pendingPermissionCall: PluginCall? = null

    private val exercisePermission = HealthPermission.getReadPermission(ExerciseSessionRecord::class)
    private val distancePermission = HealthPermission.getReadPermission(DistanceRecord::class)
    private val caloriesPermission = HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)
    private val heartRatePermission = HealthPermission.getReadPermission(HeartRateRecord::class)
    private val exercisePermissions = setOf(
        exercisePermission,
        distancePermission,
        caloriesPermission,
        heartRatePermission,
    )

    override fun load() {
        permissionLauncher = bridge.registerForActivityResult(
            PermissionController.createRequestPermissionResultContract(),
        ) {
            val call = pendingPermissionCall ?: return@registerForActivityResult
            pendingPermissionCall = null
            scope.launch { resolveStatus(call) }
        }
    }

    override fun handleOnDestroy() {
        pendingPermissionCall?.reject("권한 요청이 중단되었습니다.")
        pendingPermissionCall = null
        scope.cancel()
        super.handleOnDestroy()
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        scope.launch { resolveStatus(call) }
    }

    @PluginMethod
    fun requestReadPermissions(call: PluginCall) {
        if (!isAvailable()) {
            call.resolve(statusResult(false, emptySet()))
            return
        }
        if (pendingPermissionCall != null) {
            call.reject("이미 Health Connect 권한을 요청하고 있습니다.")
            return
        }

        val requestedTypes = call.getArray("dataTypes")?.toStringSet().orEmpty()
        if ("EXERCISE" !in requestedTypes) {
            scope.launch { resolveStatus(call) }
            return
        }

        pendingPermissionCall = call
        permissionLauncher.launch(exercisePermissions)
    }

    @PluginMethod
    fun readRecords(call: PluginCall) {
        scope.launch {
            try {
                if (!isAvailable()) {
                    call.reject("이 기기에서 Health Connect를 사용할 수 없습니다.")
                    return@launch
                }
                val requestedTypes = call.getArray("dataTypes")?.toStringSet().orEmpty()
                val startTime = call.getString("startTime")?.let(Instant::parse)
                    ?: Instant.now().minus(Duration.ofDays(30))
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                if (exercisePermission !in granted || "EXERCISE" !in requestedTypes) {
                    call.resolve(JSObject().put("records", JSArray()))
                    return@launch
                }

                val records = readExerciseRecords(client, granted, startTime, Instant.now())
                call.resolve(JSObject().put("records", records))
            } catch (error: Exception) {
                call.reject(error.message ?: "Health Connect 운동기록을 읽지 못했습니다.", error)
            }
        }
    }

    private fun isAvailable(): Boolean =
        HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

    private suspend fun resolveStatus(call: PluginCall) {
        try {
            if (!isAvailable()) {
                call.resolve(statusResult(false, emptySet()))
                return
            }
            val client = HealthConnectClient.getOrCreate(context)
            val granted = client.permissionController.getGrantedPermissions()
            call.resolve(statusResult(true, granted))
        } catch (error: Exception) {
            call.reject(error.message ?: "Health Connect 상태를 확인하지 못했습니다.", error)
        }
    }

    private fun statusResult(available: Boolean, granted: Set<String>): JSObject {
        val grantedTypes = JSArray()
        if (exercisePermission in granted) grantedTypes.put("EXERCISE")
        return JSObject()
            .put("available", available)
            .put("grantedDataTypes", grantedTypes)
    }

    private suspend fun readExerciseRecords(
        client: HealthConnectClient,
        granted: Set<String>,
        startTime: Instant,
        endTime: Instant,
    ): JSArray {
        val output = JSArray()
        var pageToken: String? = null
        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = ExerciseSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                    dataOriginFilter = setOf(samsungHealthOrigin),
                    pageToken = pageToken,
                ),
            )
            response.records.forEach { session ->
                val distance = if (distancePermission in granted) aggregateDistance(client, session) else null
                val calories = if (caloriesPermission in granted) aggregateCalories(client, session) else null
                val averageHeartRate = if (heartRatePermission in granted) aggregateHeartRate(client, session) else null

                output.put(JSObject().apply {
                    put("externalRecordId", session.metadata.id)
                    put("sourcePackage", session.metadata.dataOrigin.packageName)
                    put("dataType", "EXERCISE")
                    put("date", session.startTime.atZone(ZoneId.systemDefault()).toLocalDate().toString())
                    put("startTime", session.startTime.toString())
                    put("endTime", session.endTime.toString())
                    put("lastModifiedTime", session.metadata.lastModifiedTime.toString())
                    put("unit", session.title?.takeIf { it.isNotBlank() } ?: exerciseName(session.exerciseType))
                    put("durationMinutes", Duration.between(session.startTime, session.endTime).toSeconds() / 60.0)
                    distance?.let { put("distanceKm", it) }
                    calories?.let { put("caloriesKcal", it) }
                    averageHeartRate?.let { put("averageHeartRate", it) }
                })
            }
            pageToken = response.pageToken
        } while (pageToken != null)
        return output
    }

    private suspend fun aggregateDistance(client: HealthConnectClient, session: ExerciseSessionRecord): Double? =
        runCatching {
            client.aggregate(
                AggregateRequest(
                    metrics = setOf(DistanceRecord.DISTANCE_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(session.startTime, session.endTime),
                    dataOriginFilter = setOf(session.metadata.dataOrigin),
                ),
            )[DistanceRecord.DISTANCE_TOTAL]?.inKilometers
        }.getOrNull()

    private suspend fun aggregateCalories(client: HealthConnectClient, session: ExerciseSessionRecord): Double? =
        runCatching {
            client.aggregate(
                AggregateRequest(
                    metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(session.startTime, session.endTime),
                    dataOriginFilter = setOf(session.metadata.dataOrigin),
                ),
            )[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
        }.getOrNull()

    private suspend fun aggregateHeartRate(client: HealthConnectClient, session: ExerciseSessionRecord): Long? =
        runCatching {
            client.aggregate(
                AggregateRequest(
                    metrics = setOf(HeartRateRecord.BPM_AVG),
                    timeRangeFilter = TimeRangeFilter.between(session.startTime, session.endTime),
                    dataOriginFilter = setOf(session.metadata.dataOrigin),
                ),
            )[HeartRateRecord.BPM_AVG]
        }.getOrNull()

    private fun exerciseName(exerciseType: Int): String = when (exerciseType) {
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING -> "자전거"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "실내 자전거"
        ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL -> "일립티컬"
        ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "하이킹"
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE -> "로잉 머신"
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING -> "러닝"
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "트레드밀"
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING -> "근력 운동"
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL -> "수영"
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "걷기"
        ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> "웨이트 트레이닝"
        ExerciseSessionRecord.EXERCISE_TYPE_YOGA -> "요가"
        else -> "Samsung Health 운동"
    }

    private fun JSArray.toStringSet(): Set<String> = buildSet {
        for (index in 0 until length()) {
            optString(index).takeIf { it.isNotBlank() }?.let(::add)
        }
    }
}
