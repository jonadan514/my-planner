package com.jonadan514.myplanner

import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class PermissionsRationaleActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val padding = (24 * resources.displayMetrics.density).toInt()
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(padding, padding, padding, padding)
        }
        container.addView(TextView(this).apply {
            text = "건강 데이터 사용 안내"
            textSize = 22f
        })
        container.addView(TextView(this).apply {
            text = "Prec는 사용자가 허용한 운동 기록을 Health Connect에서 읽어 운동 시간, 거리, 칼로리와 평균 심박수를 앱 안에 표시합니다. 데이터는 이 기기의 앱 저장소에만 보관되며 외부 서버로 전송하지 않습니다. 권한은 언제든 Health Connect 설정에서 해제할 수 있습니다."
            textSize = 16f
            setPadding(0, padding, 0, 0)
        })
        setContentView(container)
    }
}
