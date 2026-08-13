package com.jonadan514.myplanner

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

@CapacitorPlugin(name = "LiveAppBridge")
class LiveAppBridgePlugin : Plugin() {
    companion object {
        const val LIVE_APP_URL = "https://my-planner-brown.vercel.app/"
        const val PREFERENCES_NAME = "prec_live_app"
        const val LIVE_MODE_KEY = "live_mode"
        private const val BACKUP_FILE_NAME = "live-app-migration.json"
    }

    private val preferences by lazy {
        context.getSharedPreferences(PREFERENCES_NAME, android.content.Context.MODE_PRIVATE)
    }

    private val backupFile: File
        get() = File(context.filesDir, BACKUP_FILE_NAME)

    @PluginMethod
    fun getState(call: PluginCall) {
        call.resolve(JSObject().apply {
            put("liveMode", preferences.getBoolean(LIVE_MODE_KEY, false))
            put("hasPendingBackup", backupFile.exists() && backupFile.length() > 0)
        })
    }

    @PluginMethod
    fun enableLiveApp(call: PluginCall) {
        val backup = call.getString("backup")
        if (backup == null) {
            call.reject("백업 데이터가 없습니다.")
            return
        }

        try {
            writeBackupAtomically(backup)
            if (!preferences.edit().putBoolean(LIVE_MODE_KEY, true).commit()) {
                throw IllegalStateException("라이브 앱 설정을 저장하지 못했습니다.")
            }
            call.resolve()
            activity.runOnUiThread { activity.recreate() }
        } catch (error: Exception) {
            call.reject("앱 전환용 백업을 저장하지 못했습니다.", error)
        }
    }

    @PluginMethod
    fun restartInLiveMode(call: PluginCall) {
        call.resolve()
        activity.runOnUiThread { activity.recreate() }
    }

    @PluginMethod
    fun readPendingBackup(call: PluginCall) {
        try {
            if (!backupFile.exists()) {
                call.reject("복원할 백업이 없습니다.")
                return
            }
            call.resolve(JSObject().apply { put("backup", backupFile.readText(Charsets.UTF_8)) })
        } catch (error: Exception) {
            call.reject("백업을 읽지 못했습니다.", error)
        }
    }

    @PluginMethod
    fun completeMigration(call: PluginCall) {
        try {
            if (backupFile.exists() && !backupFile.delete()) {
                throw IllegalStateException("복원 완료 후 백업을 정리하지 못했습니다.")
            }
            call.resolve()
        } catch (error: Exception) {
            call.reject("백업 정리를 완료하지 못했습니다.", error)
        }
    }

    private fun writeBackupAtomically(contents: String) {
        val temporaryFile = File(context.filesDir, "$BACKUP_FILE_NAME.tmp")
        temporaryFile.writeText(contents, Charsets.UTF_8)
        if (backupFile.exists() && !backupFile.delete()) {
            temporaryFile.delete()
            throw IllegalStateException("기존 백업을 교체하지 못했습니다.")
        }
        if (!temporaryFile.renameTo(backupFile)) {
            temporaryFile.copyTo(backupFile, overwrite = true)
            temporaryFile.delete()
        }
    }
}
